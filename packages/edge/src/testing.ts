// Test-only helpers shared by the apps' e2e and unit tests (design D7; the
// `_headers` parser below serves the tests that keep the static-asset headers
// equal to the worker's, design D8). The package exposes this module as
// `@ycmcuenca/edge/testing`; app code never imports it, so it stays out of
// app bundles (design D10).
import type { Page, Response } from "@playwright/test";
import { cspDirectives } from "./headers.ts";
import { readFileSync } from "node:fs";

export type Violation = { directive: string; blockedURI: string };

declare global {
  interface Window {
    cspViolations: Violation[];
  }
}

/** Starts collecting policy violations before the page's own scripts run. */
export async function trackViolations(page: Page): Promise<void> {
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

export function collectedViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => window.cspViolations);
}

export function headerOf(
  response: Response | null,
  name: string,
): string | undefined {
  return response?.headers()[name.toLowerCase()];
}

// The directive sources as the header carries them (`self` is written
// `'self'`). Hashes are dropped from both sides: SvelteKit appends them for
// the inline scripts and styles it generates, the unit test pins the app's
// own, and the violation check proves every hash the browser needs is
// present.
export function withoutHashes(sources: string[]): string[] {
  return sources.filter((source) => !/^'?sha(?:256|384|512)-/.test(source));
}

export const expectedCsp: Record<string, string[]> = Object.fromEntries(
  Object.entries(cspDirectives).map(([directive, sources]) => [
    directive,
    withoutHashes(
      sources.map((source) => (source === "data:" ? "data:" : `'${source}'`)),
    ),
  ]),
);

export function cspWithoutHashes(
  response: Response | null,
): Record<string, string[]> {
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

/**
 * The `/*` rule of an app's `_headers` file, parsed into a header map (design
 * D8): the file serves the static assets, which never pass through the
 * worker.
 */
export function headersUnderEveryPath(
  headersFile: URL,
): Record<string, string> {
  const text = readFileSync(headersFile, "utf8");
  const rule = text.split(/^\/\*$/m)[1];
  if (rule === undefined) {
    throw new Error("_headers has no rule for /*");
  }
  const headers: Record<string, string> = {};
  for (const line of rule.split("\n")) {
    const match = /^ +([A-Za-z-]+): (.+)$/.exec(line);
    const name = match?.[1];
    const value = match?.[2];
    if (name !== undefined && value !== undefined) {
      headers[name] = value;
    }
  }
  return headers;
}
