import { describe, expect, it } from "vitest";
import { publishingStatus } from "./status";

describe("publishingStatus", () => {
  it("is live with a published revision and a clean projection", () => {
    expect(
      publishingStatus({
        publishedRevisionId: "revision-1",
        projectionState: "clean",
      }),
    ).toBe("live");
  });

  it("is published-not-live with a published revision and a dirty projection", () => {
    expect(
      publishingStatus({
        publishedRevisionId: "revision-1",
        projectionState: "dirty",
      }),
    ).toBe("published-not-live");
  });

  it("is not-published with no published revision and a clean projection", () => {
    expect(
      publishingStatus({
        publishedRevisionId: null,
        projectionState: "clean",
      }),
    ).toBe("not-published");
  });

  it("is not-published with no published revision and a dirty projection", () => {
    expect(
      publishingStatus({
        publishedRevisionId: null,
        projectionState: "dirty",
      }),
    ).toBe("not-published");
  });
});
