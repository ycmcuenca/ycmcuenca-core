import { describe, expect, it } from "vitest";
import { accepted, markdownOfBytes } from "../test-helpers";
import {
  article,
  articleSchema,
  bodyByteLimit,
  validateArticle,
} from "./article";
import type { ArticleContent, ArticleErrors } from "./article";

const validInput = {
  title: "A title",
  slug: "a-title",
  summary: "A summary",
  body: [{ type: "markdown", source: "Hi" }],
};

function contentFor(input: unknown): ArticleContent {
  const result = validateArticle(input);
  if (!result.ok) {
    throw new Error(
      `expected validation to pass: ${JSON.stringify(result.errors)}`,
    );
  }
  return result.content;
}

function errorsFor(input: unknown): ArticleErrors {
  const result = validateArticle(input);
  if (result.ok) {
    throw new Error("expected validation to fail");
  }
  return result.errors;
}

function withSource(source: string): unknown {
  return { ...validInput, body: [{ type: "markdown", source }] };
}

describe("article", () => {
  it("has the three fields and a markdown body, in the spec's order", () => {
    expect(article.name).toBe("article");
    expect(article.fields.map((field) => field.name)).toEqual([
      "title",
      "slug",
      "summary",
    ]);
    expect(article.body).toEqual({ blocks: ["markdown"] });
  });
});

describe("validateArticle", () => {
  it("returns the content of a valid article", () => {
    expect(articleSchema.safeParse(validInput).success).toBe(true);
    expect(validateArticle(validInput)).toEqual({
      ok: true,
      content: validInput,
    });
  });

  it("trims the title and the summary", () => {
    const content = contentFor({
      ...validInput,
      title: "  A title  ",
      summary: " A summary ",
    });

    expect(content.title).toBe("A title");
    expect(content.summary).toBe("A summary");
  });

  it("keeps the body's blocks in the order they arrived", () => {
    const body = [
      { type: "markdown", source: "first" },
      { type: "markdown", source: "second" },
    ];

    expect(contentFor({ ...validInput, body }).body).toEqual(body);
  });

  it("reports an empty title and an invalid slug together", () => {
    expect(
      errorsFor({ ...validInput, title: "", slug: "Hello World" }),
    ).toEqual({
      title: "Enter the title.",
      slug: "Use lowercase letters, digits and single hyphens, with no hyphen at either end.",
    });
  });

  it("reports a missing slug and an over-limit body together", () => {
    const body = [
      { type: "markdown", source: markdownOfBytes(bodyByteLimit + 1) },
    ];

    expect(errorsFor({ ...validInput, slug: undefined, body })).toEqual({
      slug: "Enter the slug.",
      body: "Use at most 32768 bytes of Markdown.",
    });
  });

  it("reports a block with no Markdown source on that block", () => {
    expect(errorsFor({ ...validInput, body: [{ type: "markdown" }] })).toEqual({
      "body.0.source": "Enter the Markdown source.",
    });
  });

  it("reports input that is not an article object", () => {
    expect(errorsFor(null)).toEqual({ "": "Enter an article." });
  });

  it("reports an empty body on the body", () => {
    expect(errorsFor({ ...validInput, body: [] })).toEqual({
      body: "Add at least one block.",
    });
  });

  it("reports an unknown block type on that block", () => {
    expect(errorsFor({ ...validInput, body: [{ type: "image" }] })).toEqual({
      "body.0.type": "Only markdown blocks are supported.",
    });
  });

  it("holds the body limit the spec states", () => {
    expect(bodyByteLimit).toBe(32_768);
  });

  it("accepts a body of exactly 32,768 bytes", () => {
    const source = markdownOfBytes(bodyByteLimit);
    // The body holds fewer characters than its byte count, so a character
    // count would accept more Markdown than the limit allows.
    expect(source.length).toBeLessThan(bodyByteLimit);

    expect(accepted(articleSchema, withSource(source))).toBeDefined();
  });

  it("rejects 32,769 bytes with a message that names the limit", () => {
    expect(errorsFor(withSource(markdownOfBytes(bodyByteLimit + 1)))).toEqual({
      body: "Use at most 32768 bytes of Markdown.",
    });
  });
});
