<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PublishingStatus } from "@ycmcuenca/cms-core";
  import { BlockList } from "@ycmcuenca/cms-render";
  import {
    Alert,
    AlertDescription,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@ycmcuenca/ui";
  import EntryForm from "#lib/components/EntryForm.svelte";
  import { keepEnteredValues } from "#lib/forms.js";
  import { statusLabel } from "#lib/publishing-status.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // A refused or previewed submission shows what the owner entered; otherwise
  // the form shows the latest revision (design D2, D3).
  const values = $derived(form?.values ?? data.values);
  const errors = $derived(form?.errors ?? {});
  const preview = $derived(form?.preview);
  const message = $derived(form?.message ?? "");
  const status = $derived(
    statusLabel(data.status, data.publishedRevisionNumber),
  );

  function statusVariant(
    kind: PublishingStatus,
  ): "default" | "secondary" | "outline" {
    if (kind === "live") {
      return "default";
    }
    return kind === "published-not-live" ? "secondary" : "outline";
  }
</script>

<h1>{data.entry.slug}</h1>
<p>
  <Badge variant={statusVariant(data.status)}>{status}</Badge>
</p>

{#if message}
  <Alert variant="destructive" class="mt-4">
    <AlertDescription>{message}</AlertDescription>
  </Alert>
{/if}

<Card class="mt-6">
  <CardHeader>
    <CardTitle>Edit</CardTitle>
  </CardHeader>
  <CardContent>
    <form method="POST" action="?/save" use:enhance={keepEnteredValues}>
      <EntryForm
        description={data.description}
        {values}
        {errors}
        slugLocked={data.slugLocked}
      />
      <div class="mt-4 flex flex-wrap gap-2">
        <Button type="submit">Save</Button>
        <Button type="submit" variant="outline" formaction="?/preview">
          Preview
        </Button>
      </div>
    </form>
  </CardContent>
</Card>

{#if preview !== undefined}
  <Card class="mt-6">
    <CardHeader>
      <CardTitle>Preview</CardTitle>
    </CardHeader>
    <CardContent>
      <BlockList blocks={preview} />
    </CardContent>
  </Card>
{/if}

<Card class="mt-6">
  <CardHeader>
    <CardTitle>Revisions</CardTitle>
  </CardHeader>
  <CardContent>
    <ol class="space-y-3">
      {#each data.revisions as revision, index (revision.id)}
        {@const newest = index === data.revisions.length - 1}
        <li class="flex flex-wrap items-center gap-2">
          <span>Revision {revision.number}: {revision.title}</span>
          <time
            class="text-muted-foreground text-sm"
            datetime={revision.createdAt}
          >
            {revision.createdAt}
          </time>
          {#if newest}
            <form method="POST" action="?/publish">
              <input type="hidden" name="revisionId" value={revision.id} />
              <Button type="submit" size="sm">Publish</Button>
            </form>
          {:else if data.publishedRevisionId !== null}
            <form method="POST" action="?/rollBack">
              <input type="hidden" name="revisionId" value={revision.id} />
              <Button type="submit" size="sm" variant="outline">
                Roll back to this
              </Button>
            </form>
          {/if}
        </li>
      {/each}
    </ol>

    <div class="mt-4 flex flex-wrap gap-2">
      {#if data.publishedRevisionId !== null}
        <form method="POST" action="?/unpublish">
          <Button type="submit" variant="destructive">Unpublish</Button>
        </form>
      {/if}
      {#if data.dirty}
        <form method="POST" action="?/retry">
          <Button type="submit">Retry</Button>
        </form>
      {/if}
    </div>
  </CardContent>
</Card>
