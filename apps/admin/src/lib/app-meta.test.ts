import { describe, expect, it } from "vitest";
import { appName } from "./app-meta";

// Guards the name the placeholder page renders (design D6): the page uses
// `appName` for its <h1>, so this test failing means the page is wrong too.
describe("appName", () => {
  it("is the app's display name", () => {
    expect(appName).toBe("Admin");
  });
});
