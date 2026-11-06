// The one place that knows how an entry form meets the content model (design
// D2, D3): the body is a single Markdown block, a published entry's slug is
// the entry's own, and form values come back out of a stored revision.
import type {
  ArticleContent,
  ArticleErrors,
  Block,
  EntryRecord,
  StoredContent,
} from "@ycmcuenca/cms-core";
import { validateArticle } from "@ycmcuenca/cms-core";
import type { DuplicateSlugError } from "@ycmcuenca/db";

/** The values the form shows: one entry per field, plus the body's Markdown. */
export type EntryFormValues = {
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: string;
};

/** What a posted form becomes: the input `validateArticle` reads (design D3). */
export interface ArticleInput {
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: readonly Block[];
}

/** The slug a form may not change, from the entry it edits (design D2). */
export interface SlugSource {
  /** The entry's current slug. */
  readonly slug: string;
  /** Whether the entry is published, which freezes its slug. */
  readonly slugLocked: boolean;
}

/** The slug source of a stored entry: a published entry's slug is frozen. */
export function slugSourceFor(entry: EntryRecord): SlugSource {
  return { slug: entry.slug, slugLocked: entry.firstPublishedAt !== null };
}

/** A posted form that validated: its input, its values and its content. */
export interface ReadArticle {
  readonly input: ArticleInput;
  readonly values: EntryFormValues;
  readonly content: ArticleContent;
}

/** A posted form, either read and validated or refused with its messages. */
export type ArticleFormRead =
  | ({ readonly ok: true } & ReadArticle)
  | {
      readonly ok: false;
      readonly errors: ArticleErrors;
      readonly values: EntryFormValues;
    };

/**
 * Reads a posted form and validates it (design D3). Create, save and preview all
 * start this way, so a refused form shows the same messages and the same
 * entered values on every page.
 */
export function readArticleForm(
  form: FormData,
  source: SlugSource,
): ArticleFormRead {
  const input = articleInputFrom(form, source);
  const values = formValuesFromInput(input);
  const validated = validateArticle(input);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors, values };
  }
  return { ok: true, input, values, content: validated.content };
}

/**
 * Turns a posted form into article input (design D2). A published entry's slug
 * cannot change, so a posted slug is ignored in favour of the entry's own.
 */
export function articleInputFrom(
  form: FormData,
  source: SlugSource,
): ArticleInput {
  return {
    title: postedValue(form, "title"),
    slug: source.slugLocked ? source.slug : postedValue(form, "slug"),
    summary: lineEndingsFrom(postedValue(form, "summary")),
    body: [
      {
        type: "markdown",
        source: lineEndingsFrom(postedValue(form, "body")),
      },
    ],
  };
}

/**
 * The values the edit form starts with, read from an entry's latest revision
 * (design D3). The form edits one Markdown block, so a body of several blocks
 * is joined back into the one source the form shows.
 */
export function formValuesFrom(
  slug: string,
  stored: StoredContent,
): EntryFormValues {
  return {
    title: stored.content.title,
    slug,
    summary: stored.content.summary,
    body: bodySource(stored.content.body),
  };
}

/**
 * The values a posted form showed, read back from the input it produced, so a
 * refused submission can show the form again with what the owner entered
 * (design D3). A locked slug is the entry's own, which is what the form shows.
 */
export function formValuesFromInput(input: ArticleInput): EntryFormValues {
  return {
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    body: bodySource(input.body),
  };
}

/**
 * A taken slug, shown at the slug field in the store's own words (design D2).
 * Creating and saving share this, so both pages say the same thing.
 */
export function takenSlugErrors(error: DuplicateSlugError): ArticleErrors {
  return { slug: error.message };
}

// The form's one body field, rebuilt from the blocks it was parsed into.
function bodySource(body: readonly Block[]): string {
  return body.map((block) => block.source).join("\n\n");
}

// A field the form did not post is empty, which validation then reports in the
// same way as a field the owner cleared.
function postedValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

// A browser posts a textarea's line breaks as CRLF, while a stored revision
// holds LF, so saving an unchanged multi-line field would look like a change
// and add a revision (design D3). Reading the form in the store's own line
// endings keeps the comparison honest.
function lineEndingsFrom(value: string): string {
  return value.replaceAll("\r\n", "\n");
}
