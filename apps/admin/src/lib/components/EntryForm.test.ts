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

// The one label element the form renders for a field's name.
function labelFor(html: string, name: string): string {
  const match = html.match(
    new RegExp(`<label[^>]*\\bfor="${name}"[^>]*>[\\s\\S]*?</label>`),
  );
  if (match === null) {
    throw new Error(`The form has no label named ${name}.`);
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
  // The helpers read the markup as rendered, comments included, so a test never
  // has to strip tags or comments from it.
  return body;
}

describe("EntryForm", () => {
  it("shows the four labeled controls in the type's order", () => {
    const body = renderForm();

    const ids = [...body.matchAll(/for="([^"]+)"/g)].map((match) => match[1]);

    expect(ids).toEqual(["title", "slug", "summary", "body"]);
  });

  it("marks each required field with a hidden asterisk, in the type's order", () => {
    const body = renderForm();

    for (const field of description) {
      const label = labelFor(body, field.name);
      expect(label).toContain(field.label);
      if (field.required) {
        expect(label).toContain('<span aria-hidden="true">*</span>');
      } else {
        expect(label).not.toContain('<span aria-hidden="true">*</span>');
      }
      expect(control(body, field.name)).toContain("required");
    }
    expect(body.match(/<span aria-hidden="true">\*<\/span>/g)).toHaveLength(
      description.filter((field) => field.required).length,
    );
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
