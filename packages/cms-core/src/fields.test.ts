import { describe, expect, it } from "vitest";
import { multilineField, slugField, textField } from "./fields";
import { accepted, firstIssue } from "./test-helpers";

// The three fields the article type uses, with the limits the spec states.
const title = textField({
  name: "title",
  label: "Title",
  required: true,
  limit: 120,
});
const summary = multilineField({
  name: "summary",
  label: "Summary",
  required: true,
  limit: 300,
});
const slug = slugField({
  name: "slug",
  label: "Slug",
  required: true,
  limit: 80,
});

describe("textField", () => {
  it("accepts a value of exactly the limit", () => {
    expect(title.schema.safeParse("x".repeat(120)).success).toBe(true);
  });

  it("rejects one character more, naming the limit", () => {
    expect(firstIssue(title.schema, "x".repeat(121))).toMatchObject({
      message: "Use at most 120 characters.",
      path: [],
    });
  });

  it("rejects a line break", () => {
    expect(firstIssue(title.schema, "one\ntwo")?.message).toBe(
      "Keep the title on one line.",
    );
    expect(firstIssue(title.schema, "one\r\ntwo")?.message).toBe(
      "Keep the title on one line.",
    );
  });

  it("removes leading and trailing whitespace", () => {
    expect(accepted(title.schema, "  A title  ")).toBe("A title");
  });

  it("rejects a value that is whitespace alone", () => {
    expect(firstIssue(title.schema, "   ")?.message).toBe("Enter the title.");
  });

  it("gives a missing or non-string value the field's own message", () => {
    expect(firstIssue(title.schema, undefined)?.message).toBe(
      "Enter the title.",
    );
    expect(firstIssue(title.schema, 5)?.message).toBe("Enter the title.");
  });

  it("describes itself for the form", () => {
    expect(title).toMatchObject({
      name: "title",
      label: "Title",
      editor: "text",
      required: true,
      limit: 120,
    });
  });
});

describe("slugField", () => {
  it("accepts words joined by single hyphens, with digits", () => {
    expect(slug.schema.safeParse("hello-world-2").success).toBe(true);
  });

  it("rejects an uppercase letter and a space", () => {
    expect(firstIssue(slug.schema, "Hello World")?.message).toBe(
      "Use lowercase letters, digits and single hyphens, with no hyphen at either end.",
    );
  });

  it("rejects a leading hyphen", () => {
    expect(firstIssue(slug.schema, "-hello")).toBeDefined();
  });

  it("rejects a trailing hyphen", () => {
    expect(firstIssue(slug.schema, "hello-")).toBeDefined();
  });

  it("rejects two hyphens in a row", () => {
    expect(firstIssue(slug.schema, "hello--world")).toBeDefined();
  });

  it("rejects one character more than the limit", () => {
    expect(firstIssue(slug.schema, "h".repeat(81))?.message).toBe(
      "Use at most 80 characters.",
    );
  });

  it("rejects an empty slug without complaining about its shape", () => {
    expect(firstIssue(slug.schema, "")?.message).toBe("Enter the slug.");
  });

  it("uses a single-line editor", () => {
    expect(slug.editor).toBe("text");
  });
});

describe("multilineField", () => {
  it("accepts a line break", () => {
    expect(accepted(summary.schema, "one\ntwo")).toBe("one\ntwo");
  });

  it("removes leading and trailing whitespace", () => {
    expect(accepted(summary.schema, "  A summary  ")).toBe("A summary");
  });

  it("rejects one character more than the limit", () => {
    expect(firstIssue(summary.schema, "x".repeat(301))?.message).toBe(
      "Use at most 300 characters.",
    );
  });

  it("uses a multi-line editor", () => {
    expect(summary.editor).toBe("textarea");
  });
});
