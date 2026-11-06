<script lang="ts">
  // The entry form, generated from the type's own description (design D2): it
  // loops over the fields, so a field added to the content type appears here
  // with no Svelte change. Routes own the form element and its buttons.
  import type { ArticleErrors, FieldDescription } from "@ycmcuenca/cms-core";
  import { Input, Label, Textarea } from "@ycmcuenca/ui";

  interface Props {
    /** The type's fields in the order the form shows them. */
    description: readonly FieldDescription[];
    /** The current value of every field, keyed by field name. */
    values: Readonly<Record<string, string>>;
    /** One message per invalid field, keyed by field name. */
    errors: ArticleErrors;
    /** Whether the entry is published, which freezes its slug. */
    slugLocked: boolean;
  }

  let { description, values, errors, slugLocked }: Props = $props();

  // The spec's note for a slug that can no longer change.
  const lockedSlugNote = "Published slugs cannot change.";

  // The error id a control points at with `aria-describedby` (design D2).
  function errorId(field: FieldDescription): string {
    return `${field.name}-error`;
  }

  function isLocked(field: FieldDescription): boolean {
    return field.name === "slug" && slugLocked;
  }
</script>

{#each description as field (field.name)}
  {@const id = field.name}
  {@const message = errors[id]}
  <div class="space-y-2">
    <!-- The asterisk is for sight only: the control's `required` attribute is
         what assistive technology announces, so the star is hidden from it
         (design D2, amendment 2). -->
    <Label for={id}>
      {field.label}{#if field.required}<span aria-hidden="true">*</span>{/if}
    </Label>
    {#if field.editor === "markdown"}
      <!-- The limit counts bytes, so `maxlength`, which counts characters,
           would reject the wrong bodies (design D2). -->
      <Textarea
        {id}
        name={id}
        required={field.required}
        rows={24}
        value={values[id] ?? ""}
        class="font-mono"
        aria-invalid={message ? "true" : undefined}
        aria-describedby={message ? errorId(field) : undefined}
      />
    {:else if field.editor === "textarea"}
      <Textarea
        {id}
        name={id}
        required={field.required}
        maxlength={field.limit}
        value={values[id] ?? ""}
        aria-invalid={message ? "true" : undefined}
        aria-describedby={message ? errorId(field) : undefined}
      />
    {:else}
      <Input
        {id}
        name={id}
        type="text"
        required={field.required}
        maxlength={field.limit}
        value={values[id] ?? ""}
        readonly={isLocked(field)}
        aria-invalid={message ? "true" : undefined}
        aria-describedby={message ? errorId(field) : undefined}
      />
    {/if}
    {#if field.help}
      <p class="text-muted-foreground text-sm">{field.help}</p>
    {/if}
    {#if isLocked(field)}
      <p class="text-muted-foreground text-sm">{lockedSlugNote}</p>
    {/if}
    {#if message}
      <p id={errorId(field)} class="text-destructive text-sm">{message}</p>
    {/if}
  </div>
{/each}
