<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<h1>{data.entry.slug}</h1>
<p>{data.status}</p>

{#if form?.message}
  <p role="alert">{form.message}</p>
{/if}

<h2>Revisions</h2>
<ol>
  {#each data.revisions as revision, index (revision.id)}
    {@const newest = index === data.revisions.length - 1}
    <li>
      Revision {revision.number}: {revision.title}
      (<time datetime={revision.createdAt}>{revision.createdAt}</time>)
      {#if newest}
        <form method="POST" action="?/publish">
          <input type="hidden" name="revisionId" value={revision.id} />
          <button type="submit">Publish</button>
        </form>
      {:else if data.publishedRevisionId !== null}
        <form method="POST" action="?/rollBack">
          <input type="hidden" name="revisionId" value={revision.id} />
          <button type="submit">Roll back to this</button>
        </form>
      {/if}
    </li>
  {/each}
</ol>

{#if data.publishedRevisionId !== null}
  <form method="POST" action="?/unpublish">
    <button type="submit">Unpublish</button>
  </form>
{/if}

{#if data.dirty}
  <form method="POST" action="?/retry">
    <button type="submit">Retry</button>
  </form>
{/if}
