// A content type describes its own form (design D6): an ordered list of field
// descriptions, so `admin` renders any type generically and adding a type in a
// later sprint needs no new form code. The description is plain data, with no
// Svelte and no HTML, so this package stays free of UI code.
import type { FieldDefinition } from "./fields.ts";
import { bodyByteLimit } from "./types/article.ts";
import type { ContentType } from "./types/article.ts";

/**
 * One input of a type's form (design D6): a field's metadata without its
 * schema, which a form never renders. `limit` counts characters, or bytes for
 * the body.
 */
export type FieldDescription = Omit<FieldDefinition, "schema">;

/**
 * The ordered inputs of one type's form: its fields, then its body (design
 * D6). The label and the limit are the same ones validation uses, so a form
 * and its validation cannot drift apart.
 */
export function formDescription(type: ContentType): FieldDescription[] {
  return [
    ...type.fields.map(describeField),
    {
      name: "body",
      label: "Body",
      editor: "markdown",
      required: true,
      limit: bodyByteLimit,
    },
  ];
}

// The field's metadata alone: the schema is its validation and stays out of a
// form, which is why `FieldDescription` leaves it behind (design D6).
function describeField(field: FieldDefinition): FieldDescription {
  return {
    name: field.name,
    label: field.label,
    help: field.help,
    editor: field.editor,
    required: field.required,
    limit: field.limit,
  };
}
