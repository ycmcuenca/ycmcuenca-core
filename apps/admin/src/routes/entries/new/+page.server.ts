// The create page (design D3): one action stores the article and opens its
// entry page, the other renders the unsaved body without writing anything.
import {
  article,
  formDescription,
  renderBody,
  validateArticle,
} from "@ycmcuenca/cms-core";
import { createEntry, DuplicateSlugError } from "@ycmcuenca/db";
import { fail, redirect } from "@sveltejs/kit";
import { withDatabase } from "#lib/server/database.js";
import {
  articleInputFrom,
  formValuesFromInput,
  takenSlugErrors,
} from "#lib/server/entry-form.js";
import type { EntryFormValues } from "#lib/server/entry-form.js";
import type { Actions, PageServerLoad } from "./$types";

/** The form the create page starts with: every field empty (design D2). */
const emptyValues: EntryFormValues = {
  title: "",
  slug: "",
  summary: "",
  body: "",
};

// A new entry has no stored slug to protect, so the posted one is used as is.
const newEntrySlug = { slug: "", slugLocked: false };

export const load: PageServerLoad = () => ({
  description: formDescription(article),
  values: emptyValues,
});

export const actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const input = articleInputFrom(form, newEntrySlug);
    const values = formValuesFromInput(input);
    const validated = validateArticle(input);
    if (!validated.ok) {
      return fail(400, { errors: validated.errors, values });
    }
    try {
      const created = await withDatabase((database) =>
        createEntry(database, input),
      );
      if (!created.ok) {
        return fail(400, { errors: created.errors, values });
      }
      redirect(303, `/entries/${created.entry.id}`);
    } catch (error) {
      if (error instanceof DuplicateSlugError) {
        return fail(400, { errors: takenSlugErrors(error), values });
      }
      throw error;
    }
  },
  preview: async ({ request }) => {
    const form = await request.formData();
    const input = articleInputFrom(form, newEntrySlug);
    const values = formValuesFromInput(input);
    const validated = validateArticle(input);
    if (!validated.ok) {
      return fail(400, { errors: validated.errors, values });
    }
    return { values, preview: renderBody(validated.content.body) };
  },
} satisfies Actions;
