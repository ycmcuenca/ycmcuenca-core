<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PublishingStatus } from "@ycmcuenca/cms-core";
  import { Badge, Button } from "@ycmcuenca/ui";
  import { appName } from "#lib/app-meta.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const count = $derived(
    data.count === 1 ? "1 entry" : `${data.count} entries`,
  );

  const statusLabels: Record<PublishingStatus, string> = {
    live: "Live",
    "not-published": "Not published",
    "published-not-live": "Published, not live",
  };

  function statusVariant(
    kind: PublishingStatus,
  ): "default" | "secondary" | "outline" {
    if (kind === "live") {
      return "default";
    }
    return kind === "published-not-live" ? "secondary" : "outline";
  }
</script>

<h1>{appName}</h1>
<p>{count}</p>

<Button class="mt-4" href={resolve("/entries/new")}>New article</Button>

{#if data.entries.length > 0}
  <ul class="mt-6 space-y-3">
    {#each data.entries as entry (entry.id)}
      <li class="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <a
          class="font-medium underline-offset-4 hover:underline"
          href={resolve("/entries/[id]", { id: entry.id })}
        >
          {entry.title}
        </a>
        <code class="text-muted-foreground text-sm">{entry.slug}</code>
        <Badge variant={statusVariant(entry.status)}>
          {statusLabels[entry.status]}
        </Badge>
        <time
          class="text-muted-foreground ml-auto text-sm"
          datetime={entry.lastSavedAt}
        >
          {entry.lastSavedAt}
        </time>
      </li>
    {/each}
  </ul>
{/if}
