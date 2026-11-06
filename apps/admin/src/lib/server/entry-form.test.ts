import type { StoredContent } from "@ycmcuenca/cms-core";
import { DuplicateSlugError } from "@ycmcuenca/db";
import { describe, expect, it } from "vitest";
import {
  articleInputFrom,
  formValuesFrom,
  takenSlugErrors,
} from "./entry-form";

const unlocked = { slug: "first-post", slugLocked: false };
const locked = { slug: "first-post", slugLocked: true };

// The form's four fields as the browser posts them.
function postedForm(slug: string): FormData {
  const form = new FormData();
  form.set("title", "First post");
  form.set("slug", slug);
  form.set("summary", "The first article.");
  form.set("body", "## Hello\n\nSome **Markdown**.");
  return form;
}

const stored: StoredContent = {
  schema_v: 1,
  content: {
    title: "First post",
    summary: "The first article.",
    body: [{ type: "markdown", source: "## Hello\n\nSome **Markdown**." }],
  },
};

describe("articleInputFrom", () => {
  it("posts the Markdown body as one block", () => {
    const input = articleInputFrom(postedForm("first-post"), unlocked);

    expect(input).toEqual({
      title: "First post",
      slug: "first-post",
      summary: "The first article.",
      body: [{ type: "markdown", source: "## Hello\n\nSome **Markdown**." }],
    });
  });

  it("ignores the posted slug while the entry is locked", () => {
    const input = articleInputFrom(postedForm("another-slug"), locked);

    expect(input.slug).toBe("first-post");
  });
});

describe("formValuesFrom", () => {
  it("reads a stored revision back into the form's values", () => {
    expect(formValuesFrom("first-post", stored)).toEqual({
      title: "First post",
      slug: "first-post",
      summary: "The first article.",
      body: "## Hello\n\nSome **Markdown**.",
    });
  });
});

describe("takenSlugErrors", () => {
  it("shows the store's taken-slug message at the slug field", () => {
    const errors = takenSlugErrors(new DuplicateSlugError("first-post"));

    expect(errors).toEqual({
      slug: 'An article already uses the slug "first-post".',
    });
  });
});
