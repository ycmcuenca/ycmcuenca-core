import { article, formDescription } from "@ycmcuenca/cms-core";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import EntryForm from "./EntryForm.svelte";

const description = formDescription(article);

const values = {
  title: "First post",
  slug: "first-post",
  summary: "The first article.",
  body: "## Hello\n\nSome **Markdown**.",
};

// The one control the form renders under a field's name.
function control(html: string, name: string): string {
  const match = html.match(
    new RegExp(`<(?:input|textarea)[^>]*\\bname="${name}"[^>]*>`),
  );
  if (match === null) {
    throw new Error(`The form has no control named ${name}.`);
  }
  return match[0];
}

function renderForm(
  errors: Record<string, string> = {},
  slugLocked = false,
): string {
  const { body } = render(EntryForm, {
    props: { description, values, errors, slugLocked },
  });
  // Svelte marks its hydration boundaries with empty comments, which split a
  // label's text from its tags in a naive search.
  return body.replace(/<!--[\s\S]*?-->/g, "");
}

describe("EntryForm", () => {
  it("shows the four labeled controls in the type's order", () => {
    const body = renderForm();

    const labels = ["Title", "Slug", "Summary", "Body"];
    const positions = labels.map((label) => body.indexOf(`>${label}</label>`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
    expect(body).toContain('for="title"');
    expect(body).toContain('for="body"');
  });

  it("limits the title, slug and summary, and leaves the body unlimited", () => {
    const body = renderForm();

    expect(control(body, "title")).toContain('maxlength="120"');
    expect(control(body, "slug")).toContain('maxlength="80"');
    expect(control(body, "summary")).toContain('maxlength="300"');
    expect(control(body, "body")).not.toContain("maxlength");
  });

  it("marks a field with an error invalid and points at its message", () => {
    const body = renderForm({ title: "Enter the title." });

    expect(control(body, "title")).toContain('aria-invalid="true"');
    expect(control(body, "title")).toContain('aria-describedby="title-error"');
    expect(body).toContain("Enter the title.");
    expect(body).toContain('id="title-error"');
  });

  it("shows a published entry's slug read-only with the note", () => {
    const body = renderForm({}, true);

    const slug = control(body, "slug");
    expect(slug).toContain("readonly");
    expect(slug).toContain('value="first-post"');
    expect(body).toContain("Published slugs cannot change.");
  });

  it("leaves a never-published entry's slug editable", () => {
    const body = renderForm();

    expect(control(body, "slug")).not.toContain("readonly");
    expect(body).not.toContain("Published slugs cannot change.");
  });
});
