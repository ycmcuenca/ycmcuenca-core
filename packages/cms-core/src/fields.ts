// The field layer of the content model (design D2): a field is a validated
// value together with the form metadata `admin` renders it with. The schema
// carries the limit the spec states and `formDescription` reads the same
// `limit`, so a form and its validation cannot disagree.
import { z } from "zod";

/** The editor kind a form renders for a field (design D2). */
export type FieldEditor = "text" | "textarea" | "markdown";

/** A field of a content type: its validation and its form metadata. */
export interface FieldDefinition {
  /** The key this field's value has in the content. */
  readonly name: string;
  /** The text the form shows for the input. */
  readonly label: string;
  /** Guidance the form shows under the input, when there is any. */
  readonly help?: string;
  /** The input the form renders. */
  readonly editor: FieldEditor;
  /** Whether an empty value is invalid. */
  readonly required: boolean;
  /** The most characters the field accepts. */
  readonly limit: number;
  /** The validation of the field's value. */
  readonly schema: z.ZodType<string>;
}

/** What every field factory needs; the editor comes from the factory itself. */
export interface FieldOptions {
  readonly name: string;
  readonly label: string;
  readonly help?: string;
  readonly required: boolean;
  readonly limit: number;
}

// A slug is lowercase ASCII words joined by single hyphens: no leading or
// trailing hyphen, and no two hyphens in a row (spec: Field limits).
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugMessage =
  "Use lowercase letters, digits and single hyphens, with no hyphen at either end.";

// A single-line value holds no line break. Anchored, so a string containing
// one does not match.
const oneLine = /^[^\r\n]*$/;

/** A single-line text field (design D2). */
export function textField(options: FieldOptions): FieldDefinition {
  const message = `Keep the ${options.label.toLowerCase()} on one line.`;
  return defineField(
    options,
    "text",
    lengthLimited(textValue(options).trim(), options).regex(oneLine, message),
  );
}

/** A slug field: a single line of lowercase words joined by hyphens (D2). */
export function slugField(options: FieldOptions): FieldDefinition {
  return defineField(
    options,
    "text",
    lengthLimited(textValue(options), options).regex(slugPattern, slugMessage),
  );
}

/** A multi-line text field, for a value a person writes in paragraphs (D2). */
export function multilineField(options: FieldOptions): FieldDefinition {
  return defineField(
    options,
    "textarea",
    lengthLimited(textValue(options).trim(), options),
  );
}

// The value of a text field. A value of the wrong type carries the same
// message as an empty one, so no Zod default text ever reaches a form (design
// D3). A field that is not required keeps the type check alone; no type in
// Sprint 2 has one.
function textValue(options: FieldOptions): z.ZodString {
  return options.required
    ? z.string({ error: requiredMessage(options) })
    : z.string();
}

function requiredMessage(options: FieldOptions): string {
  return `Enter the ${options.label.toLowerCase()}.`;
}

// The two checks every field carries, each with the message `admin` shows:
// a required value may not be empty, and no value may exceed the limit. They
// run in this order, so an empty value reports "Enter the ..." alone.
function lengthLimited(
  schema: z.ZodString,
  options: FieldOptions,
): z.ZodString {
  const nonEmpty = options.required
    ? schema.min(1, requiredMessage(options))
    : schema;
  return nonEmpty.max(
    options.limit,
    `Use at most ${options.limit} characters.`,
  );
}

function defineField(
  options: FieldOptions,
  editor: FieldEditor,
  schema: z.ZodType<string>,
): FieldDefinition {
  return {
    name: options.name,
    label: options.label,
    help: options.help,
    editor,
    required: options.required,
    limit: options.limit,
    schema,
  };
}
