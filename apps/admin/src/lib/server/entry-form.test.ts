import type { EntryRecord, StoredContent } from "@ycmcuenca/cms-core";
import { DuplicateSlugError } from "@ycmcuenca/db";
import { describe, expect, it } from "vitest";
import {
  articleInputFrom,
  formValuesFrom,
  formValuesFromInput,
  readArticleForm,
  slugSourceFor,
  takenSlugErrors,
} from "./entry-form";

const unlocked = { slug: "first-post", slugLocked: false };
const locked = { slug: "first-post", slugLocked: true };

const entry: EntryRecord = {
  id: "6f1b6f5e-6f6a-4f6b-8f5e-6f6a4f6b8f5e",
  type: "article",
  slug: "first-post",
  publishedRevisionId: null,
  firstPublishedAt: null,
  lastPublishedAt: null,
  projectionState: "clean",
};

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

  it("reads a browser's CRLF line breaks back as the store's LF", () => {
    const form = postedForm("first-post");
    form.set("summary", "The first\r\narticle.");
    form.set("body", "## Hello\r\n\r\nSome **Markdown**.");

    const input = articleInputFrom(form, unlocked);

    expect(input.summary).toBe("The first\narticle.");
    expect(input.body).toEqual([
      { type: "markdown", source: "## Hello\n\nSome **Markdown**." },
    ]);
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

describe("formValuesFromInput", () => {
  it("shows a refused submission with the values it posted", () => {
    const input = articleInputFrom(postedForm("first-post"), unlocked);

    expect(formValuesFromInput(input)).toEqual({
      title: "First post",
      slug: "first-post",
      summary: "The first article.",
      body: "## Hello\n\nSome **Markdown**.",
    });
  });
});

describe("slugSourceFor", () => {
  it("keeps an unpublished entry's slug free to change", () => {
    expect(slugSourceFor(entry)).toEqual({
      slug: "first-post",
      slugLocked: false,
    });
  });

  it("freezes the slug of an entry that has been published", () => {
    const publishedAt = new Date("2026-11-06T09:00:00.000Z");

    expect(slugSourceFor({ ...entry, firstPublishedAt: publishedAt })).toEqual({
      slug: "first-post",
      slugLocked: true,
    });
  });
});

describe("readArticleForm", () => {
  it("reads a valid form into input, values and content", () => {
    expect(readArticleForm(postedForm("first-post"), unlocked)).toEqual({
      ok: true,
      input: {
        title: "First post",
        slug: "first-post",
        summary: "The first article.",
        body: [{ type: "markdown", source: "## Hello\n\nSome **Markdown**." }],
      },
      values: {
        title: "First post",
        slug: "first-post",
        summary: "The first article.",
        body: "## Hello\n\nSome **Markdown**.",
      },
      content: {
        title: "First post",
        slug: "first-post",
        summary: "The first article.",
        body: [{ type: "markdown", source: "## Hello\n\nSome **Markdown**." }],
      },
    });
  });

  it("refuses an invalid form with its messages and the entered values", () => {
    const form = postedForm("first-post");
    form.set("title", "");

    expect(readArticleForm(form, unlocked)).toEqual({
      ok: false,
      errors: { title: "Enter the title." },
      values: {
        title: "",
        slug: "first-post",
        summary: "The first article.",
        body: "## Hello\n\nSome **Markdown**.",
      },
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
