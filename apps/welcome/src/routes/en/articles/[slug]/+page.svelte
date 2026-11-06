<script lang="ts">
  import { BlockList } from "@ycmcuenca/cms-render";
  import { dateOnly } from "#lib/dates.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // The UTC calendar day the snapshot's first-publish time falls on (D3).
  const published = $derived(dateOnly(data.article.publishedAt));
  // The last-update date is shown only when it differs from the first (D3).
  const updated = $derived(dateOnly(data.article.updatedAt));
  const showUpdated = $derived(updated !== published);
</script>

<article>
  <h1>{data.article.title}</h1>
  <p>
    Published <time datetime={published}>{published}</time>
    {#if showUpdated}
      · Updated <time datetime={updated}>{updated}</time>
    {/if}
  </p>
  <BlockList blocks={data.article.blocks} />
</article>
