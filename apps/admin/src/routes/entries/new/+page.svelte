<script lang="ts">
  import { enhance } from "$app/forms";
  import { BlockList } from "@ycmcuenca/cms-render";
  import { Button } from "@ycmcuenca/ui";
  import EntryForm from "#lib/components/EntryForm.svelte";
  import { keepEnteredValues } from "#lib/forms.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // A refused or previewed submission shows what the owner entered; otherwise
  // the form starts empty (design D2, D3).
  const values = $derived(form?.values ?? data.values);
  const errors = $derived(form?.errors ?? {});
  const preview = $derived(form?.preview);
</script>

<h1>New article</h1>

<form method="POST" action="?/create" use:enhance={keepEnteredValues}>
  <EntryForm
    description={data.description}
    {values}
    {errors}
    slugLocked={false}
  />
  <div class="mt-4 flex flex-wrap gap-2">
    <Button type="submit">Create</Button>
    <Button type="submit" variant="outline" formaction="?/preview">
      Preview
    </Button>
  </div>
</form>

{#if preview !== undefined}
  <section class="mt-8 space-y-2">
    <h2 class="text-xl font-semibold">Preview</h2>
    <BlockList blocks={preview} />
  </section>
{/if}
