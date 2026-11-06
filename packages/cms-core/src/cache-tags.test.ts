import { describe, expect, it } from "vitest";
import { entryTag, indexTag, localeTag, typeTag } from "./cache-tags";
import { entryKey } from "./snapshot-keys";

describe("entryTag", () => {
  it("names one entry by its type and slug", () => {
    expect(entryTag("article", "hello-world")).toBe(
      "entry:article:hello-world",
    );
  });

  it("equals the KV key of the same entry, so a tag names one entry", () => {
    expect(entryTag("article", "hello-world")).toBe(
      entryKey("article", "hello-world"),
    );
  });
});

describe("indexTag", () => {
  it("names one type's index by its type and locale", () => {
    expect(indexTag("article", "en")).toBe("index:article:en");
  });
});

describe("typeTag", () => {
  it("names every page that lists a type", () => {
    expect(typeTag("article")).toBe("type:article");
  });
});

describe("localeTag", () => {
  it("names every page in a locale", () => {
    expect(localeTag("en")).toBe("locale:en");
  });
});
