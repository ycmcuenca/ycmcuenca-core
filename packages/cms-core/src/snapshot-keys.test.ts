import { describe, expect, it } from "vitest";
import { entryKey, indexKey } from "./snapshot-keys";

describe("entryKey", () => {
  it("names one entry by its type and slug", () => {
    expect(entryKey("article", "hello-world")).toBe(
      "entry:article:hello-world",
    );
  });
});

describe("indexKey", () => {
  it("names one type's index by its type and locale", () => {
    expect(indexKey("article", "en")).toBe("index:article:en");
  });
});
