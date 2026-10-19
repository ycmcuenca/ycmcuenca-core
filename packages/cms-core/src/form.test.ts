import { describe, expect, it } from "vitest";
import { markdownOfBytes } from "./test-helpers";
import { formDescription } from "./form";
import type { FieldDescription } from "./form";
import { article, validateArticle } from "./types/article.ts";

const validArticle = {
  title: "A title",
  slug: "a-title",
  summary: "A summary",
  body: [{ type: "markdown", source: "Hi" }],
};

// How a value of exactly `size` is built for one described field: characters
// for the text fields, UTF-8 bytes for the body.
const valueOfSize: Record<string, (size: number) => Record<string, unknown>> = {
  title: (size) => ({ title: "x".repeat(size) }),
  slug: (size) => ({ slug: "a".repeat(size) }),
  summary: (size) => ({ summary: "x".repeat(size) }),
  body: (size) => ({
    body: [{ type: "markdown", source: markdownOfBytes(size) }],
  }),
};

function filledWith(field: FieldDescription, size: number): unknown {
  const build = valueOfSize[field.name];
  if (build === undefined) {
    throw new Error(`no value of the described field ${field.name}`);
  }
  return { ...validArticle, ...build(size) };
}

describe("formDescription", () => {
  it("describes the article exactly as the spec states", () => {
    expect(formDescription(article)).toEqual([
      {
        name: "title",
        label: "Title",
        editor: "text",
        required: true,
        limit: 120,
      },
      {
        name: "slug",
        label: "Slug",
        editor: "text",
        required: true,
        limit: 80,
      },
      {
        name: "summary",
        label: "Summary",
        editor: "textarea",
        required: true,
        limit: 300,
      },
      {
        name: "body",
        label: "Body",
        editor: "markdown",
        required: true,
        limit: 32_768,
      },
    ]);
  });

  it("agrees with validation at every limit it states", () => {
    for (const field of formDescription(article)) {
      expect(validateArticle(filledWith(field, field.limit)).ok).toBe(true);
      expect(validateArticle(filledWith(field, field.limit + 1)).ok).toBe(
        false,
      );
    }
  });
});
