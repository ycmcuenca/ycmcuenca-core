import { baselineSecurityHeaders } from "@ycmcuenca/edge";
import { headersUnderEveryPath } from "@ycmcuenca/edge/testing";
import { describe, expect, it } from "vitest";

// The `_headers` file at the app root is what static assets are served with,
// since they never pass through the worker. This test keeps its values equal
// to the ones the worker sets, so the two sources cannot drift (design D8).
const expected: Record<string, string> = {
  ...baselineSecurityHeaders,
  "X-Robots-Tag": "noindex, nofollow",
};

describe("_headers", () => {
  it("carries exactly the baseline values from the package plus X-Robots-Tag", () => {
    expect(
      headersUnderEveryPath(new URL("../../_headers", import.meta.url)),
    ).toEqual(expected);
  });
});
