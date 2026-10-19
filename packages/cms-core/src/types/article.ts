// The article type: the only content type in Sprint 2 (design D2). It is
// built from the field and block layers, and `validateArticle` turns raw
// input into content or into one message per invalid field (design D3).
import { z } from "zod";
import { blockTypes, bodySchema } from "../blocks.ts";
import type { BlockTypeName } from "../blocks.ts";
import { multilineField, slugField, textField } from "../fields.ts";
import type { FieldDefinition } from "../fields.ts";

/** The most bytes of Markdown one article's body may hold (design D5). */
export const bodyByteLimit = 32_768;

/** The limit as the error message names it. */
const bodyByteLimitMessage = `Use at most ${bodyByteLimit} bytes of Markdown.`;

/** A content type: the fields a form renders, and the blocks a body allows. */
export interface ContentType {
  /** The name the type is stored and published under. */
  readonly name: string;
  /** The type's fields, in the order the form shows them. */
  readonly fields: readonly FieldDefinition[];
  /** The block types a body of this type may hold. */
  readonly body: { readonly blocks: readonly BlockTypeName[] };
}

const titleField = textField({
  name: "title",
  label: "Title",
  required: true,
  limit: 120,
});
const articleSlugField = slugField({
  name: "slug",
  label: "Slug",
  required: true,
  limit: 80,
});
const summaryField = multilineField({
  name: "summary",
  label: "Summary",
  required: true,
  limit: 300,
});

/** The article type: three fields and a body of markdown blocks (design D2). */
export const article: ContentType = {
  name: "article",
  fields: [titleField, articleSlugField, summaryField],
  body: { blocks: blockTypes },
};

// The fields a stored revision holds. The slug is left out because the entry
// row keeps it, where it can be unique per type, and a revision records what
// the owner wrote (design D4).
//
// The byte limit rides on the body rather than on the article object: Zod
// skips an object-level refinement once another field has a non-continuable
// issue, and a body over the limit must report even when a field is missing
// (design D3). It is also what lets the revision schema below omit the slug,
// which a refined object refuses (design D4).
const revisionFields = {
  title: titleField.schema,
  summary: summaryField.schema,
  body: bodySchema.superRefine(checkBodyByteLimit),
};

/** The validation of an article, including the body's limits (D2, D5). */
export const articleSchema = z.object(
  { slug: articleSlugField.schema, ...revisionFields },
  { error: "Enter an article." },
);

/**
 * The content a stored revision holds: the article without its slug, still
 * bound by the body's limits (design D4).
 */
export const revisionContent = articleSchema.omit({ slug: true });

/** An article as it is stored and validated. */
export type ArticleContent = z.infer<typeof articleSchema>;

/** One message per invalid field, keyed by the field's path. */
export type ArticleErrors = Record<string, string>;

/** What validation returns: the content, or the messages of invalid fields. */
export type ArticleValidation =
  | { readonly ok: true; readonly content: ArticleContent }
  | { readonly ok: false; readonly errors: ArticleErrors };

/**
 * Validates raw input as an article (design D3). Every invalid field is
 * reported at once, so a form can show all of them together.
 */
export function validateArticle(input: unknown): ArticleValidation {
  const result = articleSchema.safeParse(input);
  if (result.success) {
    return { ok: true, content: result.data };
  }
  return { ok: false, errors: errorsByPath(result.error.issues) };
}

/** The Markdown of a body, as the byte limit measures it. */
type BodySource = readonly { source: string }[];

// The spec's byte limit, checked on the body itself so it reports alongside
// every other field's problem (design D3, D5). No path is given, so the issue
// lands on the body the check measured.
function checkBodyByteLimit(body: BodySource, context: z.RefinementCtx): void {
  if (bodyByteSize(body) > bodyByteLimit) {
    context.addIssue({ code: "custom", message: bodyByteLimitMessage });
  }
}

// The Markdown of the whole body, counted in UTF-8 bytes (design D5).
function bodyByteSize(body: BodySource): number {
  const encoder = new TextEncoder();
  return body.reduce(
    (total, block) => total + encoder.encode(block.source).length,
    0,
  );
}

// One message per path, the first Zod reports for it, so a field shows one
// message and the paths stay the keys the form looks up (design D3).
function errorsByPath(
  issues: readonly { path: PropertyKey[]; message: string }[],
): ArticleErrors {
  const errors: ArticleErrors = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    errors[path] ??= issue.message;
  }
  return errors;
}
