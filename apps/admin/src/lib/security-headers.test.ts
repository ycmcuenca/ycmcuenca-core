import { baselineSecurityHeaders } from "@ycmcuenca/edge";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The `_headers` file at the app root is what static assets are served with,
// since they never pass through the worker. This test keeps its values equal
// to the ones the worker sets, so the two sources cannot drift (design D8).
const expected: Record<string, string> = {
  ...baselineSecurityHeaders,
  "X-Robots-Tag": "noindex, nofollow",
};

function headersUnderEveryPath(): Record<string, string> {
  const text = readFileSync(new URL("../../_headers", import.meta.url), "utf8");
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

describe("_headers", () => {
  it("carries exactly the baseline values from the package plus X-Robots-Tag", () => {
    expect(headersUnderEveryPath()).toEqual(expected);
  });
});
